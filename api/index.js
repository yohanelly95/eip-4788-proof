import express from "express";
import { config } from "./config.js";
import { getValidatorProof } from "./handlers/validator.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => res.send("PONG!"));

// * validator proof
app.get("/validator/:slot/:validatorIndex", getValidatorProof);

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
