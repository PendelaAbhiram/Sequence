import 'react-native-gesture-handler';
import React from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  HomeScreen,
  BotSetupScreen,
  ModeSelectScreen,
  PlayerSetupScreen,
  GameScreen,
  ResultScreen,
  TutorialScreen,
  SettingsScreen,
  LobbyScreen,
  OnlineScreen,
  RootStackParamList,
} from './src/screens';

import { useSettingsStore } from './src/store/settingsStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const loadSettingsAndStats = useSettingsStore((s) => s.loadSettingsAndStats);

  React.useEffect(() => {
    loadSettingsAndStats();
  }, [loadSettingsAndStats]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              contentStyle: { backgroundColor: '#060B14' },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="BotSetup" component={BotSetupScreen} />
            <Stack.Screen name="PlayerSetup" component={PlayerSetupScreen} />
            <Stack.Screen name="ModeSelect" component={ModeSelectScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="Result" component={ResultScreen} />
            <Stack.Screen name="Tutorial" component={TutorialScreen} />
            <Stack.Screen
              name="Rules"
              component={TutorialScreen}
              initialParams={{ initialTab: 'rules' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Lobby" component={LobbyScreen} />
            <Stack.Screen name="Online" component={OnlineScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060B14',
  },
});
