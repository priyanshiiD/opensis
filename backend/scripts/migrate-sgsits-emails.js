require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const Faculty = require('../src/models/Faculty');

const canonicalizeInstitutionalEmail = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!email.includes('@')) return null;
  if (!/@(?:[^@]+\.)?college\.edu$/i.test(email)) return null;
  const localPart = email.split('@')[0];
  return `${localPart}@sgsits.ac.in`;
};

async function migrateCollection(Model, field, label) {
  let updated = 0;
  let skipped = 0;
  const docs = await Model.find({ [field]: /college\.edu$/i }).lean();

  for (const doc of docs) {
    const currentEmail = doc[field];
    const nextEmail = canonicalizeInstitutionalEmail(currentEmail);
    if (!nextEmail) continue;

    const conflict = await Model.findOne({
      [field]: nextEmail,
      _id: { $ne: doc._id },
    }).lean();
    if (conflict) {
      skipped += 1;
      continue;
    }

    await Model.updateOne({ _id: doc._id }, { $set: { [field]: nextEmail } });
    updated += 1;
  }

  console.log(`${label}: updated ${updated}, skipped duplicate ${skipped}`);
}

const migrateSgsitsEmails = async () => {
  await migrateCollection(User, 'email', 'Users');
  await migrateCollection(Student, 'personalEmail', 'Student personal emails');
  await migrateCollection(Faculty, 'personalEmail', 'Faculty personal emails');
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await migrateSgsitsEmails();
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { migrateSgsitsEmails };

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
