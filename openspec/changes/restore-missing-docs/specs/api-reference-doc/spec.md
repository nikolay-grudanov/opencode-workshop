## ADDED Requirements

### Requirement: Exhaustive HTTP route catalog

The `ai-docs/API.md` document SHALL list every HTTP route exposed by the daemon under `/api/*`, parsed from `src/server.ts`. Each route entry MUST include: HTTP method, full path (including path params like `:id`), query parameters with type and default, request body shape (or "none"), response shape with status codes, and a minimal `curl` example. Routes that the fork has removed or added vs upstream MUST be tagged.

#### Scenario: Reader needs to call a specific endpoint

- **WHEN** a contributor wants to fetch the outline of a run via the API
- **THEN** the catalog has an entry for `GET /api/runs/:id/outline` showing query params, response JSON shape, and a working `curl http://localhost:5899/api/runs/<id>/outline` example

#### Scenario: Plugin author needs to know the ingest endpoint

- **WHEN** a plugin author is implementing trace publishing
- **THEN** the catalog documents the OTLP ingest endpoint (path, expected payload encoding, response codes), so the plugin can target it without reading daemon source

### Requirement: WebSocket event catalog

The document SHALL list every WebSocket event the daemon emits or accepts (e.g. live span streaming, annotation broadcasts), with: event name, direction (server→client or client→server), payload shape, and the trigger condition. The catalog MUST be derived from the WS handlers in `src/server.ts`.

#### Scenario: UI developer needs to subscribe to live spans

- **WHEN** a frontend developer is implementing the live-span streaming view
- **THEN** the WS event catalog documents the event name, payload shape per event, and the connection URL, so the developer can write the client without reverse-engineering server code

### Requirement: Status code and error shape reference

The document SHALL include a section listing every non-2xx status code the daemon returns, with the error response body shape (e.g. `{ "error": string, "code": string }`) and the conditions under which each status is returned (404 for unknown run id, 401 for cloud auth — noting 401 disappears after F-001 lands).

#### Scenario: Client developer handling errors

- **WHEN** a client developer is writing error handling for API calls
- **THEN** the error reference lets them anticipate 404 / 400 / 500 shapes without trial-and-error curl calls

### Requirement: Auth and config caveats

The document SHALL include an "Auth and config" section stating that this fork has NO authentication (local-only), and listing the env vars that affect API behavior (`RAINDROP_WORKSHOP_PORT`, `RAINDROP_WORKSHOP_DB_PATH`, `RAINDROP_LOCAL_DEBUGGER`). It MUST mark cloud-auth references (write keys, OAuth) as **removed in F-001** with a forward pointer to `remove-cloud-integration-f001`.

#### Scenario: Reader looking for auth requirements

- **WHEN** a reader expects to find API token requirements
- **THEN** the auth section makes clear there are none (local-only daemon) and points them to F-001 for the historical context of cloud-auth removal

### Requirement: Source citation per route

Every route and event entry in the document SHALL cite the line in `src/server.ts` where it is defined, so a reviewer can verify the doc matches the implementation. Citation format: `` `src/server.ts:LL-LL` ``.

#### Scenario: Reviewer verifying doc accuracy

- **WHEN** a reviewer is validating that API.md matches the daemon code
- **THEN** each route entry has a line citation, letting the reviewer open `src/server.ts` at that line and confirm directly
