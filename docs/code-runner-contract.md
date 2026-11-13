# Code execution provider

CareerPilot forwards authenticated Code Arena submissions server-side to the endpoint stored in `CODE_EXECUTOR_URL`. `CODE_EXECUTOR_API_KEY` is sent in the `Authorization` header and never reaches the browser. The configured OnlineCompiler endpoint should be `https://api.onlinecompiler.io/api/run-code-sync/`.

The adapter maps the supported languages as follows:

| CareerPilot | OnlineCompiler compiler |
| --- | --- |
| `python` | `python-3.14` |
| `javascript` | `nodejs-24` |
| `java` | `openjdk-25` |
| `cpp` | `g++-15` |

Requests include source, stdin, an 8 second runtime limit, and a 128 MB memory limit. The provider documents `compiler`, `code`, `input`, `time_limit`, and `memory_limit` for its synchronous run endpoint. CareerPilot accepts the returned `output`, `error`, and integer `exit_code`, truncating output before sending it to the browser. The API applies a 35 second total request timeout to allow compilation overhead.

Review the provider's current [API documentation](https://onlinecompiler.io/docs/run-code) and [compiler IDs](https://onlinecompiler.io/docs/compilers). A provider rejection may mean the key is invalid, the account has reached its limit, or the configured endpoint/key type does not permit REST runs. Do not use a browser widget key as the REST API key.
