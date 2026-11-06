<?php

namespace App\Enums;

enum ProductStatus: string
{
    case BROUILLON = 'BROUILLON';
    case EN_ATTENTE = 'EN_ATTENTE';
    case PUBLIE = 'PUBLIE';
    case REFUSE = 'REFUSE';
    case DESACTIVE = 'DESACTIVE';
}
