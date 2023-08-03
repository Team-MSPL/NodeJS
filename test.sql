CREATE DATABASE IF NOT EXISTS danim;

USE danim;

CREATE TABLE IF NOT EXISTS Users (
  id VARCHAR(45) NOT NULL,
  password VARCHAR(45) NOT NULL,
  PRIMARY KEY (id));

INSERT INTO Users (id, password) VALUES ('ungmo2', '1234');

SELECT password FROM Users WHERE id='ungmo2';
