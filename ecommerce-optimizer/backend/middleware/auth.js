const jwt = require('jsonwebtoken');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }
    return secret;
}

function authenticateJwt(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
        };
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireRole(...allowedRoles) {
    const roleSet = new Set(allowedRoles);
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roleSet.has(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return next();
    };
}

function isOwnerOrRole(targetUserId, req, ...allowedRoles) {
    if (!req.user) return false;
    if (Number(req.user.id) === Number(targetUserId)) return true;
    return allowedRoles.includes(req.user.role);
}

module.exports = {
    authenticateJwt,
    requireRole,
    isOwnerOrRole,
    getJwtSecret,
};

