import {
    generateMultipleValidatorProofsWrapper
} from "../../script/api-validator.js";

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
