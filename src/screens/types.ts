import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  BotSetup: undefined;
  PlayerSetup: undefined;
  ModeSelect: undefined;
  Game: undefined;
  Result: undefined;
  Tutorial: { initialTab?: 'tutorial' | 'rules' } | undefined;
  Rules: { initialTab?: 'tutorial' | 'rules' } | undefined;
  Settings: undefined;
  Lobby: undefined;
  Online: { initialTab?: 'create' | 'join' } | undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
