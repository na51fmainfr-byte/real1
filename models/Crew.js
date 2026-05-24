const mongoose = require('mongoose');
const { Schema } = mongoose;

const CrewSchema = new Schema({
  crewId:     { type: String, required: true, unique: true },
  name:       { type: String, required: true },
  captainId:  { type: String, required: true },
  members:    { type: [String], default: [] },
  color:      { type: String, default: '#2b2d31' },
  jollyRoger: { type: String, default: null },
  createdAt:  { type: Date, default: Date.now }
});

CrewSchema.index({ members: 1 });

module.exports = mongoose.model('Crew', CrewSchema);
