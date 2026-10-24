const { authorize } = require('../src/middleware/auth');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test('subject import endpoints reject non-admin roles with 403', async () => {
  const res = createRes();
  const next = jest.fn();

  await authorize('admin')({ user: { role: 'faculty' } }, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Forbidden' });
  expect(next).not.toHaveBeenCalled();
});

test('subject import endpoints allow the admin role', async () => {
  const res = createRes();
  const next = jest.fn();

  await authorize('admin')({ user: { role: 'admin' } }, res, next);

  expect(res.status).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
});
