import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassVerificationService } from './services/pass-verification.service';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    validateUser: jest.Mock;
    login: jest.Mock;
    adminLogin: jest.Mock;
    register: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      adminLogin: jest.fn(),
      register: jest.fn(),
    };

    controller = new AuthController(
      authService as unknown as AuthService,
      {} as ConfigService,
      {} as PassVerificationService,
      {} as UsersService,
    );
  });

  it('logs in a valid user', async () => {
    const user = { id: 'user-1', email: 'user@example.com' };
    const loginResult = { access_token: 'token-123' };

    authService.validateUser.mockResolvedValue(user);
    authService.login.mockResolvedValue(loginResult);

    await expect(
      controller.login({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).resolves.toEqual(loginResult);

    expect(authService.validateUser).toHaveBeenCalledWith(
      'user@example.com',
      'password123',
    );
    expect(authService.login).toHaveBeenCalledWith(user);
  });

  it('rejects login when credentials are missing', async () => {
    await expect(
      controller.login({
        email: '',
        password: 'password123',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(authService.validateUser).not.toHaveBeenCalled();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('rejects login when the user cannot be validated', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(
      controller.login({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(authService.validateUser).toHaveBeenCalledWith(
      'user@example.com',
      'wrong-password',
    );
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('delegates admin login to the auth service', async () => {
    const result = { access_token: 'admin-token' };
    authService.adminLogin.mockResolvedValue(result);

    await expect(
      controller.adminLogin({
        email: 'admin@example.com',
        password: 'secret',
      }),
    ).resolves.toEqual(result);

    expect(authService.adminLogin).toHaveBeenCalledWith(
      'admin@example.com',
      'secret',
    );
  });

  it('registers a new user', async () => {
    const result = { id: 'user-1', email: 'new@example.com' };
    authService.register.mockResolvedValue(result);

    await expect(
      controller.register({
        email: 'new@example.com',
        password: 'password123',
        username: 'new-user',
      }),
    ).resolves.toEqual(result);

    expect(authService.register).toHaveBeenCalledWith(
      'new@example.com',
      'password123',
      'new-user',
    );
  });
});
