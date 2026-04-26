import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: {
    getDashboardStats: jest.Mock;
    getChartStats: jest.Mock;
    getUsers: jest.Mock;
    getAnnouncements: jest.Mock;
  };

  beforeEach(() => {
    adminService = {
      getDashboardStats: jest.fn(),
      getChartStats: jest.fn(),
      getUsers: jest.fn(),
      getAnnouncements: jest.fn(),
    };

    controller = new AdminController(adminService as unknown as AdminService);
  });

  it('returns dashboard stats', async () => {
    const stats = { totalUsers: 100, totalRevenue: 500000 };
    adminService.getDashboardStats.mockResolvedValue(stats);

    await expect(controller.getDashboardStats()).resolves.toEqual(stats);
    expect(adminService.getDashboardStats).toHaveBeenCalledTimes(1);
  });

  it('converts chart days to number before delegating', async () => {
    const result = { labels: ['2026-04-01'], revenue: [10000] };
    adminService.getChartStats.mockResolvedValue(result);

    await expect(controller.getChartStats('7' as any)).resolves.toEqual(result);
    expect(adminService.getChartStats).toHaveBeenCalledWith(7);
  });

  it('converts pagination params and forwards search', async () => {
    const result = { items: [], total: 0 };
    adminService.getUsers.mockResolvedValue(result);

    await expect(
      controller.getUsers('2' as any, '25' as any, 'tester'),
    ).resolves.toEqual(result);

    expect(adminService.getUsers).toHaveBeenCalledWith(2, 25, 'tester');
  });

  it('parses announcement active filter strings', async () => {
    const result = { items: [], total: 0 };
    adminService.getAnnouncements.mockResolvedValue(result);

    await expect(
      controller.getAnnouncements('3' as any, '15' as any, 'false'),
    ).resolves.toEqual(result);

    expect(adminService.getAnnouncements).toHaveBeenCalledWith(3, 15, false);
  });
});
