/** Labelled, collapsible entries in the browser console for following the pipeline. */
export const logStep = (label: string, value: unknown) => {
  if (process.env.NODE_ENV === "production") return;
  console.groupCollapsed(`%c[promptMotion] ${label}`, "color:#6366f1;font-weight:600");
  console.log(value);
  console.groupEnd();
};
