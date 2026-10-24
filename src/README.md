# ⚠️ Legacy — do not use

The files in `src/` are the original modular source from early development.
They are **not in sync** with the live runtime.

The single source of truth is `dist/n0body.js`, which the page in playground (`n0body/`) loads as is.

`session-supervisor.js` is the exception — it was written directly in `src/` and
is not yet bundled into `dist/`.

Do not edit files in `src/` expecting changes to appear in the live application.
Edit `dist/n0body.js`.
