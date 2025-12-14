export default {
  '*': ['eslint --fix --no-warn-ignored'],
  '**/*.ts?(x)': () => 'tsc --noEmit',
  '**/*.{js,jsx,ts,tsx}': ['prettier --write'],
  '**/*.{json,md,yml,yaml}': ['prettier --write'],
  'package.json': ['npm run check-package-json'],
  'src/**/*.{ts,tsx}': ['turbo run test:unit -- --run --bail'],
  'tests/**/*.{ts,tsx}': ['turbo run test:unit -- --run --bail'],
}
