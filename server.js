const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
.then(() => console.log("✅ MongoDB Atlas Connected"))
.catch(err => console.log(err));

/* ================= LOG SCHEMA ================= */

const logSchema = new mongoose.Schema({
    status: String,
    name: String,
    id: Number,
    timestamp: String
});

const Log = mongoose.model("Log", logSchema);

/* ================= ATTENDANCE SCHEMA ================= */

const attendanceSchema = new mongoose.Schema({
    name: String,
    id: Number,
    date: String,
    checkIn: String,
    checkOut: String,
    totalMinutes: Number
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

/* ================= USER SUMMARY SCHEMA ================= */

const summarySchema = new mongoose.Schema({
    name: String,
    id: Number,
    totalMinutes: Number
});

const Summary = mongoose.model("Summary", summarySchema);

/* ================= HELPER ================= */

function calculateMinutes(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    return Math.floor((e - s) / 60000);
}

/* ================= POST ROUTE ================= */

app.post("/log", async (req, res) => {
    try {

        const { status, name, id, timestamp } = req.body;

        // Always save raw log
        await new Log(req.body).save();

        if (status !== "AUTHORIZED") {
            return res.status(200).send("Unauthorized Logged");
        }

        const date = timestamp.split(" ")[0];

        // Check if already checked in today
        let todayRecord = await Attendance.findOne({
            id: id,
            date: date
        });

        // FIRST SCAN = CHECK-IN
        if (!todayRecord) {

            await Attendance.create({
                name,
                id,
                date,
                checkIn: timestamp,
                checkOut: null,
                totalMinutes: 0
            });

            return res.status(200).send("CHECK-IN SUCCESS");
        }

        // SECOND SCAN = CHECK-OUT
        if (todayRecord && !todayRecord.checkOut) {

            todayRecord.checkOut = timestamp;

            const minutes = calculateMinutes(
                todayRecord.checkIn,
                timestamp
            );

            todayRecord.totalMinutes = minutes;
            await todayRecord.save();

            // Update Lifetime Summary
            let summary = await Summary.findOne({ id });

            if (!summary) {
                await Summary.create({
                    name,
                    id,
                    totalMinutes: minutes
                });
            } else {
                summary.totalMinutes += minutes;
                await summary.save();
            }

            return res.status(200).send("CHECK-OUT SUCCESS");
        }

        // If already checked out
        return res.status(200).send("ALREADY CHECKED OUT");

    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/", (req, res) => {
    res.send("Biometric Attendance API Running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});