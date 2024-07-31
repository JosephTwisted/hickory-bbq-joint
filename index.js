const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const uri =
  "mongodb+srv://Hickoryman:Tastethebliss@cluster0-hickory.9kk9vdo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0-Hickory";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
});

let ordersCollection;
let currentOrderNumber = 1;

async function run() {
  try {
    await client.connect();
    const database = client.db("HickoryBBQ");
    ordersCollection = database.collection("orders");
    console.log("Connected to MongoDB!");
  } catch (e) {
    console.error(e);
  }
}
run().catch(console.dir);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/orders", async (req, res) => {
  try {
    const order = {
      ...req.body,
      number: currentOrderNumber++,
      createdAt: new Date(),
      completedAt: null,
    };
    const result = await ordersCollection.insertOne(order);
    io.emit("new-order", order);
    res.status(201).send(order);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/orders", async (req, res) => {
  try {
    const orders = await ordersCollection.find().toArray();
    res.send(orders);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.patch("/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    if (update.status === "picked up") {
      update.completedAt = new Date();
    }
    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update },
    );
    if (result.modifiedCount === 1) {
      const updatedOrder = await ordersCollection.findOne({
        _id: new ObjectId(id),
      });
      io.emit("update-order", updatedOrder);
      res.status(200).send(updatedOrder);
    } else {
      res.status(404).send({ message: "Order not found" });
    }
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post("/reset-order-number", async (req, res) => {
  currentOrderNumber = 1;
  res.status(200).send({ message: "Order number reset to 001" });
});

app.get("/analytics", async (req, res) => {
  try {
    const orders = await ordersCollection
      .find({ completedAt: { $ne: null } })
      .toArray();
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, order) => {
      return (
        acc +
        order.items.reduce(
          (orderAcc, item) => orderAcc + item.price * item.quantity,
          0,
        )
      );
    }, 0);
    const popularItems = orders.reduce((acc, order) => {
      if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
          acc[item.item] = (acc[item.item] || 0) + item.quantity;
        });
      }
      return acc;
    }, {});
    const averageTimeToComplete =
      orders.reduce((acc, order) => {
        const timeDiff =
          (new Date(order.completedAt) - new Date(order.createdAt)) / 60000;
        return acc + timeDiff;
      }, 0) / totalOrders;

    res.send({
      totalOrders,
      totalRevenue,
      popularItems,
      averageTimeToComplete,
    });
  } catch (e) {
    res.status(500).send(e);
  }
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
