import { generateValidatorProof } from "../../script/validator.js";

const convertBigIntToString = (obj) => {
  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }

  if (typeof obj === "object" && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = convertBigIntToString(obj[key]);
    }
    return newObj;
  }

  return obj;
};

export const getValidatorProof = async (req, res) => {
  try {
    const { slot, validatorIndex } = req.params;

    const slotNumber = Number(slot);
    const validatorIndexNumber = Number(validatorIndex);

    if (isNaN(slotNumber) || isNaN(validatorIndexNumber)) {
      return res.status(400).json({ error: "Invalid slot or validator index" });
    }

    const proof = await generateValidatorProof(
      slotNumber,
      validatorIndexNumber
    );

    // Convert any BigInt values to strings before sending response
    const sanitizedProof = convertBigIntToString(proof);
    res.send(sanitizedProof);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMultipleValidatorProofs = async (req, res) => {
  try {
    const { slot } = req.params;
    const { indexes } = req.query;

    const slotNumber = Number(slot);
    const validatorIndexes = indexes.split(",").map((i) => Number(i.trim()));

    const proofs = await Promise.all(
      validatorIndexes.map((index) => generateValidatorProof(slotNumber, index))
    );

    const sanitizedProofs = proofs.map((proof) =>
      convertBigIntToString(JSON.parse(proof))
    );

    res.send(sanitizedProofs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
