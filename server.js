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
    checkIn: String,
    checkOut: String,
    totalMinutes: Number
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

/* ================= USER SUMMARY SCHEMA ================= */

const summarySchema = new mongoose.Schema({
    name: String,
    id: Number,
    totalMinutes: Number,
    totalHours: Number,
    remainingMinutes: Number
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

        // 🔎 Check if user has open session
        let openSession = await Attendance.findOne({
            id: id,
            checkOut: null
        });

        /* ================= CHECK-IN ================= */

        if (!openSession) {

            await Attendance.create({
                name,
                id,
                checkIn: timestamp,
                checkOut: null,
                totalMinutes: 0
            });

            return res.status(200).send("CHECK-IN SUCCESS");
        }

        /* ================= CHECK-OUT ================= */

        const minutes = calculateMinutes(
            openSession.checkIn,
            timestamp
        );

        openSession.checkOut = timestamp;
        openSession.totalMinutes = minutes;
        await openSession.save();

        /* ================= UPDATE SUMMARY ================= */

        let summary = await Summary.findOne({ id });

        if (!summary) {

            const totalHours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;

            await Summary.create({
                name,
                id,
                totalMinutes: minutes,
                totalHours: totalHours,
                remainingMinutes: remainingMinutes
            });

        } else {

            summary.totalMinutes += minutes;
            summary.totalHours = Math.floor(summary.totalMinutes / 60);
            summary.remainingMinutes = summary.totalMinutes % 60;

            await summary.save();
        }

        return res.status(200).send("CHECK-OUT SUCCESS");

    } catch (err) {
        res.status(500).send(err.message);
    }
});

/* ================= ROOT ROUTE ================= */

app.get("/", (req, res) => {
    res.send("Biometric Attendance API Running 🚀");
});

/* ================= SERVER START ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});