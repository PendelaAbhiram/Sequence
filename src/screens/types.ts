import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  BotSetup: undefined;
  PlayerSetup: undefined;
  ModeSelect: undefined;
  Game: undefined;
  Result: undefined;
  Tutorial: undefined;
  Settings: undefined;
  Lobby: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
