# Registration Fix

## Issue: Registration Returns 400/401 Error

**Problem**: When trying to register a new user through the frontend, the registration failed with validation errors.

### Root Causes

1. **Missing `confirmPassword` field** in API request
   - Frontend collected `confirmPassword` but didn't send it to the API
   - Backend validation requires `confirmPassword` to match `password`

2. **Password requirements not clearly communicated**
   - Backend requires strong passwords with:
     - Minimum 8 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
     - At least one special character (!@#$%^&*(),.?":{}|<>)
   - Frontend didn't show these requirements

## Fixes Applied

### 1. Frontend - Register Component (`frontend/src/components/Register.jsx`)

**Added `confirmPassword` to API call:**
```javascript
// Before
await register({ name, email, password });

// After
await register({ name, email, password, confirmPassword });
```

**Added password requirements hint:**
```jsx
<p className="mt-1 text-xs text-gray-500">
    Muss enthalten: Großbuchstabe, Kleinbuchstabe, Zahl und Sonderzeichen
</p>
```

**Updated placeholder text:**
```jsx
placeholder="Passwort (mind. 8 Zeichen)"
```

## Password Requirements

To successfully register, passwords must:

✅ **Minimum 8 characters**
✅ **At least one uppercase letter** (A-Z)
✅ **At least one lowercase letter** (a-z)
✅ **At least one number** (0-9)
✅ **At least one special character** (!@#$%^&*(),.?":{}|<>)

### Example Valid Passwords

- `TestPass123!`
- `MySecret#456`
- `Secure@2026`
- `P@ssw0rd!`

### Example Invalid Passwords

❌ `password123` - Missing uppercase and special character
❌ `PASSWORD123!` - Missing lowercase letter
❌ `TestPassword` - Missing number and special character
❌ `Test123` - Too short, missing special character

## Testing

### Test with curl:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123!",
    "confirmPassword": "TestPass123!"
  }'
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Email verification token sent to email",
  "verificationUrl": "http://localhost:5000/api/auth/verifyemail/..."
}
```

### Test with Frontend:

1. Start the frontend: `cd frontend && npm run dev`
2. Open: http://localhost:5173
3. Click "Register" or switch to registration
4. Fill in:
   - **Name**: Test User
   - **Email**: test@example.com
   - **Password**: TestPass123!
   - **Confirm Password**: TestPass123!
5. Click "Registrieren"
6. Should see success message!

## Backend Validation

The backend validates passwords using this logic (in `backend/src/middleware/validation.js`):

```javascript
const isStrongPassword = (value) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumbers = /\d/.test(value);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

  return value.length >= minLength &&
         hasUpperCase &&
         hasLowerCase &&
         hasNumbers &&
         hasSpecialChar;
};
```

## Error Messages

### If password is too weak:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{
    "field": "password",
    "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
  }]
}
```

### If passwords don't match:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{
    "field": "confirmPassword",
    "message": "Password confirmation does not match password"
  }]
}
```

### If confirmPassword is missing:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{
    "field": "confirmPassword",
    "message": "Password confirmation is required"
  }]
}
```

## Files Modified

1. `frontend/src/components/Register.jsx`
   - Added `confirmPassword` to register call
   - Added password requirements hint
   - Updated placeholder text

## Status

✅ **Registration now works correctly**
✅ **Password requirements clearly shown**
✅ **Validation messages are clear**
✅ **Both frontend and backend validation working**

## Additional Notes

### Email Verification

After successful registration, the API returns a verification URL. In development, email verification is optional - users can login immediately. In production, you should:

1. Configure SMTP settings in `backend/.env`:
   ```env
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your_email@example.com
   SMTP_PASSWORD=your_password
   FROM_EMAIL=noreply@castingmanager.com
   FROM_NAME=Casting Manager
   ```

2. Users must verify email before they can access certain features

### Rate Limiting

Registration endpoint is rate-limited to prevent abuse:
- **5 attempts per 15 minutes** per IP address
- After limit, user must wait before trying again

---

**Fix Applied By:** Claude AI
**Date:** 2026-01-22
**Issue:** Registration validation error (missing confirmPassword)
**Status:** ✅ Resolved
