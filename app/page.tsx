'use client';
import AppProvider from './app-provider';
import Workspace from './workspace';
export default function Home() {
  return (
    <AppProvider>
      <Workspace />
    </AppProvider>
  );
}
