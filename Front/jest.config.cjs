module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { module: 'commonjs', target: 'es2022', jsx: 'react-jsx', esModuleInterop: true },
      diagnostics: false,
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts?(x)'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/main.tsx', '!src/services/api.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
};
