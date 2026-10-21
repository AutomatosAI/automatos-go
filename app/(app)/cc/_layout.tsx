// Command Centre layout placeholder (K5) — A3 replaces it with the Board / Calendar / Questions /
// Deliverables layout (US-010..US-013). The routes it must serve are src/navigation/routes.ts cc.*.
import { Stack } from 'expo-router';

export default function CommandCentreLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
