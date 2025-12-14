export default {
  // Test runner configuration
  testRunner: 'vitest',
  testRunnerComment: 'Use vitest as test runner',

  // TypeScript checker
  checker: ['typescript'],
  tsconfigFile: 'tsconfig.json',

  // Mutation testing configuration
  mutator: 'typescript',
  mutatorComment: 'Use typescript mutator for TS/JS files',

  // Files to include/exclude
  mutate: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],

  // Reporting configuration
  reporters: ['progress', 'clear-text', 'html'],
  htmlReporter: {
    baseDir: 'reports/mutation/html',
  },

  // Thresholds
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },

  // Performance
  maxConcurrentTestRunners: 4,
  timeoutMS: 60000,
  timeoutFactor: 1.5,

  // Mutators to use
  mutators: [
    'boolean',
    'string',
    'numeric',
    'array',
    'object',
    'unary',
    'binary',
    'block',
    'conditional',
    'logical',
    'assignment',
    'update',
  ],

  // Ignore specific patterns
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.next',
    'coverage',
    'reports',
  ],

  // Plugin configuration
  plugins: [
    '@stryker-mutator/vitest-runner',
    '@stryker-mutator/typescript-checker',
  ],

  // Vitest specific configuration
  vitestRunner: {
    config: './vitest.config.mts',
  },
};