import {
    generateMultipleValidatorProofsWrapper
} from "../../script/api-validator.js";

export const getMultipleValidatorProofs = async (req, res) => {
  try {
    const { indexes } = req.query;

    if (!indexes) {
      return res.status(400).json({ error: "Missing indexes query parameter" });
    }

    const validatorIndexes = indexes.split(",").map((i) => Number(i.trim()));

    const proofs = await generateMultipleValidatorProofsWrapper(
      validatorIndexes
    );

    res.json(proofs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
