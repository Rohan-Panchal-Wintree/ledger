import("./../src/app.js")
  .then(() => {
    console.log("Import check passed");
  })
  .catch((error) => {
    console.error("Import check failed");
    console.error(error);
    process.exit(1);
  });
