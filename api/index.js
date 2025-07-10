const express = require("express");
const app = express();
const { config } = require("./config");

app.get("/", (req, res) => res.send("PONG!"));

// * validator proof
app.get("/validator/:slot/:validatorIndex", (req, res) => {
  const { slot, validatorIndex } = req.params;

  // * sanitize the input i.e slot and validatorIndex needs to be a number
  const slotNumber = Number(slot);
  const validatorIndexNumber = Number(validatorIndex);

  if (isNaN(slotNumber) || isNaN(validatorIndexNumber)) {
    return res.status(400).json({ error: "Invalid slot or validator index" });
  }

  res.send(
    `Generating proof for validator ${validatorIndexNumber} at slot ${slotNumber}`
  );
});

// * balance proof
app.get("/balance/:slot/:validatorIndex", (req, res) => {
  const { slot, validatorIndex } = req.params;

  const slotNumber = Number(slot);
  const validatorIndexNumber = Number(validatorIndex);

  if (isNaN(slotNumber) || isNaN(validatorIndexNumber)) {
    return res.status(400).json({ error: "Invalid slot or validator index" });
  }

  res.send(
    `Generating balance proof for validator ${validatorIndexNumber} at slot ${slotNumber}`
  );
});

// * withdrawl proof
app.get("/withdrawal/:slot/:validatorIndex", (req, res) => {
  const { slot, validatorIndex } = req.params;

  const slotNumber = Number(slot);
  const validatorIndexNumber = Number(validatorIndex);

  if (isNaN(slotNumber) || isNaN(validatorIndexNumber)) {
    return res.status(400).json({ error: "Invalid slot or validator index" });
  }

  res.send(
    `Generating withdrawal proof for validator ${validatorIndexNumber} at slot ${slotNumber}`
  );
});

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});
