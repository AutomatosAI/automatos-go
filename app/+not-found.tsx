// Lost (PRD-001 §4.7 Edges): an app link with no screen here. Home goes back through the gate.
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import MapPinOff from 'lucide-react-native/icons/map-pin-off';

import { NOT_FOUND_COPY } from '../src/app-state/strings';
import { routes } from '../src/navigation/routes';
import { EmptyState, Screen } from '../src/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen scroll>
      <View style={styles.centre}>
        <EmptyState
          icon={MapPinOff}
          title={NOT_FOUND_COPY.title}
          message={NOT_FOUND_COPY.message}
          action={{ label: NOT_FOUND_COPY.home, onPress: () => router.replace(routes.home) }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
});
