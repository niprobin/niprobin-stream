# Copy the native client's modules instead of sharing them

The PWA reuses the native client's playback engine, Track Cache, digging and API modules (and their tests) by copying them into this repo, and the two copies evolve separately. A shared package or a monorepo would add build and versioning overhead for two clients with one user, while the n8n API is frozen and the modules are small. A fix in one copy has to be carried over to the other by hand.
