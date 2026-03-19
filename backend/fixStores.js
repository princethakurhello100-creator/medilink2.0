require("dotenv-safe").config({ allowEmptyValues: true });
const mongoose = require("mongoose");
const { Store } = require("./src/models");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await Store.deleteMany({});
  await Store.syncIndexes();
  console.log("Stores cleared and indexes rebuilt");
  await mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });