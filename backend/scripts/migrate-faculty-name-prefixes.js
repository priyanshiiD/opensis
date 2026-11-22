require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Faculty = require('../src/models/Faculty');

const PREFIXES = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.'];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const faculty = await Faculty.find({
      $or: [
        { namePrefix: { $exists: false } },
        { namePrefix: '' },
        { namePrefix: null },
        { firstName: { $regex: '^(Mr\\.|Mrs\\.|Ms\\.|Miss|Dr\\.|Prof\\.)(\\s+|$)', $options: 'i' } },
      ],
    }).lean();

    let updated = 0;
    for (const member of faculty) {
      const firstName = String(member.firstName || '').trim();
      const prefixMatch = firstName.match(/^(Mr\.|Mrs\.|Ms\.|Miss|Dr\.|Prof\.)\s+/i);
      if (!prefixMatch) continue;

      const rawPrefix = prefixMatch[1];
      const namePrefix = PREFIXES.find(prefix =>
        prefix.toLowerCase() === rawPrefix.toLowerCase()
      ) || '';
      if (!namePrefix) continue;

      const normalizedFirstName = firstName.slice(prefixMatch[0].length).trim();
      if (!normalizedFirstName) continue;

      await Faculty.updateOne(
        { _id: member._id },
        { $set: { namePrefix, firstName: normalizedFirstName } }
      );
      updated += 1;
    }

    const target = await Faculty.findOne({ employeeId: '0309457' })
      .select('employeeId namePrefix firstName lastName')
      .lean();
    console.log(`Updated legacy faculty prefixes: ${updated}`);
    console.log('Target employee 0309457:', target || 'not found');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
