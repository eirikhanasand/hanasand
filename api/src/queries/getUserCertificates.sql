SELECT c.* 
FROM certificates c
JOIN user_certificates uc ON c.id = uc.certificate_id
WHERE uc.user_id = $1::TEXT;
