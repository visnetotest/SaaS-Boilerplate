import { PactV4, Matchers } from '@pact-foundation/pact';
import path from 'path';

describe('API Contract Tests', () => {
  const provider = new PactV4({
    consumer: 'frontend',
    provider: 'api',
    port: 1234,
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: 'info',
  });

  describe('User API', () => {
    it('should fetch user profile', async () => {
      const mockData = {
        id: Matchers.like(1),
        email: Matchers.like('user@example.com'),
        name: Matchers.like('John Doe'),
        createdAt: Matchers.like('2023-01-01T00:00:00.000Z'),
      };

      provider.addInteraction({
        state: 'user exists',
        uponReceiving: 'a request for user profile',
        withRequest: {
          method: 'GET',
          path: '/api/user/profile',
          headers: {
            Authorization: Matchers.like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: mockData,
        },
      });

      const response = await fetch(`http://localhost:1234/api/user/profile`, {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('createdAt');
    });
  });

  describe('Organization API', () => {
    it('should fetch organization details', async () => {
      const mockData = {
        id: Matchers.like(1),
        name: Matchers.like('Test Organization'),
        slug: Matchers.like('test-org'),
        plan: Matchers.like('pro'),
        createdAt: Matchers.like('2023-01-01T00:00:00.000Z'),
      };

      provider.addInteraction({
        state: 'organization exists',
        uponReceiving: 'a request for organization details',
        withRequest: {
          method: 'GET',
          path: '/api/organization',
          headers: {
            Authorization: Matchers.like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: mockData,
        },
      });

      const response = await fetch(`http://localhost:1234/api/organization`, {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('slug');
      expect(data).toHaveProperty('plan');
      expect(data).toHaveProperty('createdAt');
    });
  });
});