-- Insert API key into Vault (sanitized for git)
SELECT vault.create_secret('<INSERT_YOUR_SECRET_HERE>', 'imap_test_api_key', 'API key for test polling');
