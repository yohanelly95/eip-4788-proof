import { 
  generateValidatorProofWrapper,
  generateMultipleValidatorProofsWrapper 
} from "../../script/api-validator.js";

export const getValidatorProof = async (req, res) => {
  try {
    const { slot, validatorIndex } = req.params;

    const slotNumber = Number(slot);
    const validatorIndexNumber = Number(validatorIndex);

    if (isNaN(slotNumber) || isNaN(validatorIndexNumber)) {
      return res.status(400).json({ error: "Invalid slot or validator index" });
    }

    const proof = await generateValidatorProofWrapper(
      slotNumber,
      validatorIndexNumber
    );

    // The wrapper already returns JSON string, parse it for response
    res.json(proof);
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

    const proofs = await generateMultipleValidatorProofsWrapper(
      slotNumber,
      validatorIndexes
    );
    console.log(proofs);
    // The wrapper already returns properly formatted data
    res.json(proofs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
