import { useEffect, useState } from "react";

import FormField from "../UI/FormField";

export default function MerchantSettlementRejectForm({
  formId = "merchant-rate-reject-form",
  request = null,
  onSubmit,
}) {
  const [checkerComment, setCheckerComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCheckerComment("");
    setError("");
  }, [request]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedComment = checkerComment.trim();

    if (!normalizedComment) {
      setError("Rejection reason is required.");
      return;
    }

    await onSubmit?.({
      checkerComment: normalizedComment,
    });
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Rejection Reason"
        helper="Explain why this rate change request is being rejected."
        required
        error={error}
      >
        <textarea
          name="checkerComment"
          rows={4}
          value={checkerComment}
          onChange={(event) => {
            setCheckerComment(event.target.value);

            if (error) {
              setError("");
            }
          }}
          placeholder="Enter rejection reason..."
          className="form-textarea resize-none"
        />
      </FormField>
    </form>
  );
}
