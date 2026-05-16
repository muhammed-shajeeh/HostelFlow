const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection Error: ${error.message}`);
    process.exit(1); // Application should stop if DB fails
  }
};

module.exports = connectDB;
