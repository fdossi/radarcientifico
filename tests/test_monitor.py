import unittest
from scripts.monitor import canonical, classify, level, extract

class MonitorTests(unittest.TestCase):
    def test_utm_removed(self):
        self.assertEqual(canonical("https://example.org/a/?utm_source=x&n=2"),"https://example.org/a?n=2")
    def test_categories(self):
        self.assertEqual(classify("Edital para startups e aceleração"),"Startups")
        self.assertEqual(classify("Bolsa de Pós-doc em biotecnologia"),"Bolsas")
        self.assertEqual(level("Bolsa de doutorado"),"Doutorado")
    def test_extract_dedup_and_non_official(self):
        src={"code":"test","name":"Agência","uf":"BR","url":"https://example.org/editais","mode":"govbr"}
        html='<main><a href="/edital-1">Chamada pública de bolsas de doutorado</a><a href="/edital-1">Chamada pública de bolsas de doutorado</a><a href="https://other.org/a">Chamada de bolsas externas</a></main>'
        rows=extract(src,html)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["status"],"fonte_indica_aberto")
        self.assertIsNone(rows[0]["deadline"])

if __name__=="__main__":
    unittest.main()
