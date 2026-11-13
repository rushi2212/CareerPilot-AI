"""User-isolated document retrieval backed by Qdrant and local FastEmbed vectors."""
from functools import lru_cache
from io import BytesIO
import re
import uuid
from qdrant_client import QdrantClient, models
from fastembed import TextEmbedding
import fitz
from docx import Document
from .config import settings

COLLECTION = "careerpilot_private_docs"


@lru_cache(maxsize=1)
def qdrant() -> QdrantClient:
    url = settings.qdrant_url
    if not url.startswith(("http://", "https://")):
        url = f"http://{url}"
    return QdrantClient(url=url, api_key=settings.qdrant_api_key or None, timeout=12)


@lru_cache(maxsize=1)
def embedder() -> TextEmbedding:
    return TextEmbedding(model_name=settings.embedding_model)


def chunks(text: str, size: int = 1100, overlap: int = 150) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    output=[]; start=0
    while start < len(clean) and len(output) < 500:
        end=min(len(clean),start+size)
        if end<len(clean):
            boundary=clean.rfind(". ",start+size//2,end)
            if boundary>start: end=boundary+1
        part=clean[start:end].strip()
        if part: output.append(part)
        if end>=len(clean):break
        start=max(start+1,end-overlap)
    return output


def extract_document(content:bytes,suffix:str)->str:
    if suffix==".pdf":
        if not content.startswith(b"%PDF-"):raise ValueError("Invalid PDF signature")
        with fitz.open(stream=content,filetype="pdf") as pdf:
            if len(pdf)>80:raise ValueError("Document PDF cannot exceed 80 pages")
            return "\n".join(page.get_text() for page in pdf)
    if suffix==".docx":
        if not content.startswith(b"PK"):raise ValueError("Invalid DOCX signature")
        doc=Document(BytesIO(content))
        text="\n".join(p.text for p in doc.paragraphs)
        return text+"\n"+"\n".join(" | ".join(c.text for c in row.cells) for table in doc.tables for row in table.rows)
    if suffix in (".txt",".md"):
        return content.decode("utf-8-sig")
    raise ValueError("Supported document formats are PDF, DOCX, TXT, and Markdown")


def ensure_collection():
    client=qdrant()
    if not client.collection_exists(COLLECTION):
        embedding_size=len(next(embedder().embed(["careerpilot setup"])))
        client.create_collection(COLLECTION,vectors_config=models.VectorParams(size=embedding_size,distance=models.Distance.COSINE))
        for field in ("user_id","document_id","category"):
            client.create_payload_index(COLLECTION,field,field_schema=models.PayloadSchemaType.KEYWORD)


def index_document(user_id:int,document_id:int,filename:str,text:str,category:str="learning") -> int:
    pieces=chunks(text)
    if not pieces: return 0
    ensure_collection()
    vectors=list(embedder().embed(pieces))
    points=[]
    for i,(content,vector) in enumerate(zip(pieces,vectors)):
        point_id=str(uuid.uuid5(uuid.NAMESPACE_URL,f"careerpilot:{user_id}:{document_id}:{i}"))
        points.append(models.PointStruct(id=point_id,vector=vector.tolist(),payload={"user_id":user_id,"document_id":document_id,"filename":filename,"category":category,"chunk_index":i,"text":content}))
    client=qdrant()
    for start in range(0,len(points),64):client.upsert(COLLECTION,points[start:start+64],wait=True)
    return len(points)


def search_documents(user_id:int,query:str,limit:int=5,document_id:int|None=None) -> list[dict]:
    ensure_collection()
    must=[models.FieldCondition(key="user_id",match=models.MatchValue(value=user_id))]
    if document_id is not None:must.append(models.FieldCondition(key="document_id",match=models.MatchValue(value=document_id)))
    vector=next(embedder().query_embed(query)).tolist()
    results=qdrant().query_points(collection_name=COLLECTION,query=vector,query_filter=models.Filter(must=must),limit=min(max(limit*3,limit),30),with_payload=True).points
    terms=set(re.findall(r"[a-z0-9+#.-]{2,}",query.lower()))
    ranked=[]
    for point in results:
        payload=point.payload or {};content=payload.get("text","")
        words=set(re.findall(r"[a-z0-9+#.-]{2,}",content.lower()))
        lexical=len(terms&words)/max(1,len(terms))
        dense=max(0.0,float(point.score or 0))
        ranked.append({"document_id":payload.get("document_id"),"filename":payload.get("filename"),"category":payload.get("category"),"chunk_index":payload.get("chunk_index"),"text":content,"score":round(.75*dense+.25*lexical,4)})
    return sorted(ranked,key=lambda x:x["score"],reverse=True)[:limit]


def delete_document(user_id:int,document_id:int):
    client=qdrant()
    if not client.collection_exists(COLLECTION):return
    client.delete(COLLECTION,points_selector=models.FilterSelector(filter=models.Filter(must=[models.FieldCondition(key="user_id",match=models.MatchValue(value=user_id)),models.FieldCondition(key="document_id",match=models.MatchValue(value=document_id))])),wait=True)
