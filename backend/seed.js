require("dotenv-safe").config({ allowEmptyValues: true });
const mongoose = require("mongoose");
const { Medicine, User } = require("./src/models");

const medicines = [
  { name: "Paracetamol", genericName: "Acetaminophen", category: "analgesic", manufacturer: "GSK", dosageForms: ["tablet", "syrup"], requiresPrescription: false },
  { name: "Amoxicillin", genericName: "Amoxicillin Trihydrate", category: "antibiotic", manufacturer: "Cipla", dosageForms: ["capsule", "syrup"], requiresPrescription: true },
  { name: "Ibuprofen", genericName: "Ibuprofen", category: "analgesic", manufacturer: "Abbott", dosageForms: ["tablet", "capsule"], requiresPrescription: false },
  { name: "Cetirizine", genericName: "Cetirizine Hydrochloride", category: "antihistamine", manufacturer: "Sun Pharma", dosageForms: ["tablet", "syrup"], requiresPrescription: false },
  { name: "Metformin", genericName: "Metformin Hydrochloride", category: "antidiabetic", manufacturer: "USV", dosageForms: ["tablet"], requiresPrescription: true },
  { name: "Amlodipine", genericName: "Amlodipine Besylate", category: "antihypertensive", manufacturer: "Pfizer", dosageForms: ["tablet"], requiresPrescription: true },
  { name: "Azithromycin", genericName: "Azithromycin Dihydrate", category: "antibiotic", manufacturer: "Cipla", dosageForms: ["tablet", "syrup"], requiresPrescription: true },
  { name: "Omeprazole", genericName: "Omeprazole", category: "other", manufacturer: "AstraZeneca", dosageForms: ["capsule"], requiresPrescription: false },
  { name: "Vitamin C", genericName: "Ascorbic Acid", category: "supplement", manufacturer: "Himalaya", dosageForms: ["tablet"], requiresPrescription: false },
  { name: "Vitamin D3", genericName: "Cholecalciferol", category: "supplement", manufacturer: "Sun Pharma", dosageForms: ["tablet", "drops"], requiresPrescription: false },
  { name: "Atorvastatin", genericName: "Atorvastatin Calcium", category: "antihypertensive", manufacturer: "Ranbaxy", dosageForms: ["tablet"], requiresPrescription: true },
  { name: "Fluconazole", genericName: "Fluconazole", category: "antifungal", manufacturer: "Pfizer", dosageForms: ["capsule", "injection"], requiresPrescription: true },
  { name: "Oseltamivir", genericName: "Oseltamivir Phosphate", category: "antiviral", manufacturer: "Roche", dosageForms: ["capsule", "syrup"], requiresPrescription: true },
  { name: "Dolo 650", genericName: "Paracetamol", category: "analgesic", manufacturer: "Micro Labs", dosageForms: ["tablet"], requiresPrescription: false },
  { name: "Crocin", genericName: "Paracetamol", category: "analgesic", manufacturer: "GSK", dosageForms: ["tablet", "syrup"], requiresPrescription: false },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log("[DB] Connected");

  // Create a system admin user to use as createdBy
  let admin = await User.findOne({ email: "admin@medilink.com" });
  if (!admin) {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash("Admin1234!", 12);
    admin = await User.create({ email: "admin@medilink.com", passwordHash, role: "admin" });
    console.log("[SEED] Admin user created");
  }

  // Clear existing medicines
  await Medicine.deleteMany({});
  console.log("[SEED] Cleared existing medicines");

  // Insert all medicines
  const docs = medicines.map(m => ({ ...m, createdBy: admin._id, isActive: true }));
  await Medicine.insertMany(docs);
  console.log("[SEED] Inserted " + docs.length + " medicines");

  await mongoose.disconnect();
  console.log("[SEED] Done!");
  process.exit(0);
}

seed().catch(err => { console.error("[SEED ERROR]", err.message); process.exit(1); });