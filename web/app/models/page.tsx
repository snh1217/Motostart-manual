import ModelsClient from "./ModelsClient";

export default async function ModelsPage() {
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  return <ModelsClient models={[]} readOnly={isReadOnly} />;
}
