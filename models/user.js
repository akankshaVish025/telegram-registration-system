const { default: mongoose } = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
