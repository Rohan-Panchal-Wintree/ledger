import React from "react";

const Spinner = ({ type = "xl" }) => {
  return (
    <span
      className={`loading loading-spinner loading-${type} text-primary`}
    ></span>
  );
};

export default Spinner;
