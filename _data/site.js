// The GitHub repo the site is built from (for "Edit on GitHub" links and for
// saving a recipe's status from the website) and the allowed status values.
export default {
  repo: "paulstillman/recipes",
  branch: "main",
  builtAt: new Date().toISOString(),
  statuses: ["not tried", "rarely", "regularly", "staple"],
};
