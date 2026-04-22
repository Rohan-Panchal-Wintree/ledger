import React from "react";

const Spinner = ({ type = "xl", color = "primary" }) => {
  return (
    <span
      className={`loading loading-spinner loading-${type} text-${color}`}
    ></span>
  );
};

export default Spinner;
