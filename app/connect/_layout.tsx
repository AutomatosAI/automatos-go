// /connect's screens: Connect (index) and the QR scanner (scan, US-006g), header-less like the root.
// Outside the signed-in group: the gate sends a phone here, so nothing here waits on a session.
import { Stack } from 'expo-router';

export default function ConnectLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
