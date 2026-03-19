const express = require("express");
const app = express();
app.use(express.json());
app.post("/test", (req, res) => res.json({ ok: true, body: req.body }));
app.listen(3001, () => console.log("Test server on 3001"));