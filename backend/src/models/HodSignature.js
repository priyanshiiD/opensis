const mongoose = require('mongoose');

const hodSignatureSchema = new mongoose.Schema({
  department: { type: String, required: true, unique: true, trim: true },
  imageUrl: { type: String, required: true },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset', required: true },
  contentType: { type: String, required: true },
  fileName: { type: String, required: true },
  size: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('HodSignature', hodSignatureSchema);
