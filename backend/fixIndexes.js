require("dotenv-safe").config({ allowEmptyValues: true });
const mongoose = require("mongoose");
const { Medicine } = require("./src/models");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await Medicine.syncIndexes();
  console.log("Medicine indexes rebuilt");
  await mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });